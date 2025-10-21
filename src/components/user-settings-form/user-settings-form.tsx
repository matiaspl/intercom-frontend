/* eslint-disable no-useless-escape */
import styled from "@emotion/styled";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { isBrowserFirefox, isBrowserSafari } from "../../bowser";
import { useGlobalState } from "../../global-state/context-provider";
import { useSubmitOnEnter } from "../../hooks/use-submit-form-enter-press";
import { Checkbox } from "../checkbox/checkbox";
import { ButtonWrapper } from "../generic-components";
import {
  DevicesSection,
  FormInput,
  FormSelect,
  PrimaryButton,
  SectionTitle,
  StyledWarningMessage,
} from "../form-elements/form-elements";
import {
  CheckboxWrapper,
  FetchErrorMessage,
} from "../landing-page/join-production-components";
import { TJoinProductionOptions, TProduction } from "../production-line/types";
import { isMobileApp } from "../../platform";
import { OverlayBubble } from "../../mobile-overlay/bubble";
import { DebugPanel } from "../mobile/DebugPanel";
import { ReloadDevicesButton } from "../reload-devices-button.tsx/reload-devices-button";
import { TUserSettings } from "../user-settings/types";
import { ConfirmationModal } from "../verify-decision/confirmation-modal";
import { FormItem } from "./form-item";
import { useSubmitForm } from "./use-submit-form";
import { useFetchProductionList } from "../landing-page/use-fetch-production-list";
import { FirefoxWarning } from "../production-line/firefox-warning";
import { Spinner } from "../loader/loader";
import { useWebSocket } from "../../hooks/use-websocket";
import { useWebsocketReconnect } from "../../hooks/use-websocket-reconnect";
import { useWebsocketActions } from "../../hooks/use-websocket-actions";
import { useStorage } from "../accessing-local-storage/access-local-storage";

type FormValues = TJoinProductionOptions & {
  audiooutput: string;
};

const SubmitButton = styled(PrimaryButton)<{ shouldSubmitOnEnter?: boolean }>`
  outline: ${({ shouldSubmitOnEnter }) =>
    shouldSubmitOnEnter ? "2px solid #007bff" : "none"};
  outline-offset: ${({ shouldSubmitOnEnter }) =>
    shouldSubmitOnEnter ? "2px" : "0"};
`;

export const UserSettingsForm = ({
  isJoinProduction,
  preSelected,
  buttonText,
  isProgramUser,
  setIsProgramUser,
  defaultValues,
  setJoinProductionOptions,
  customGlobalMute,
  closeAddCallView,
  updateUserSettings,
  onSave,
  isFirstConnection,
  needsConfirmation,
}: {
  isJoinProduction?: boolean;
  preSelected?: {
    preSelectedProductionId: string;
    preSelectedLineId: string;
  };
  addAdditionalCallId?: string;
  isProgramUser?: boolean;
  setIsProgramUser?: (isProgramUser: boolean) => void;
  buttonText: string;
  defaultValues: TUserSettings | FormValues;
  setJoinProductionOptions?: React.Dispatch<
    React.SetStateAction<TJoinProductionOptions | null>
  >;
  customGlobalMute?: string;
  closeAddCallView?: () => void;
  updateUserSettings?: boolean;
  onSave?: () => void;
  isFirstConnection?: string;
  needsConfirmation?: boolean;
}) => {
  const [production, setProduction] = useState<TProduction | null>(null);
  const [isProgramOutputLine, setIsProgramOutputLine] =
    useState<boolean>(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [selectedLineName, setSelectedLineName] = useState<string>("");
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const {
    formState: { errors, isValid },
    register,
    handleSubmit,
    reset,
    setValue,
    control,
  } = useForm<FormValues | TUserSettings>({
    defaultValues,
    resetOptions: {
      keepDirtyValues: true, // user-interacted input will be retained
      keepErrors: true, // input errors will be retained with value update
    },
  });

  const { productions, error: productionListFetchError } =
    useFetchProductionList({
      limit: "100",
      extended: "true",
    });

  // this will update whenever lineId changes
  const selectedLineId = useWatch({ name: "lineId", control });

  const [
    { devices, selectedProductionId, calls, userSettings },
    dispatch,
  ] = useGlobalState();

  const { onSubmit } = useSubmitForm({
    isJoinProduction,
    production,
    isProgramUser,
    setJoinProductionOptions,
    customGlobalMute,
    closeAddCallView,
    updateUserSettings,
    onSave,
    selectedLineName,
  });

  const isSettingsConfig = !isJoinProduction;
  const isMobile = isMobileApp();
  const isSupportedBrowser = isBrowserFirefox && isJoinProduction;

  // Companion (Stream Deck) connection state
  const callIndexMap = useRef<Record<number, string>>({});
  const callActionHandlers = useRef<Record<string, Record<string, () => void>>>(
    {}
  );
  const [isWSReconnecting, setIsWSReconnecting] = useState(false);
  const [isConnectionConflict, setConnectionConflict] = useState(false);
  const [hostPort, setHostPort] = useState<string>("");

  // keep index map synced with calls
  useEffect(() => {
    callIndexMap.current = {};
    Object.keys(calls || {}).forEach((callId, i) => {
      callIndexMap.current[i + 1] = callId;
    });
  }, [calls]);

  const handleAction = useWebsocketActions({
    callIndexMap,
    callActionHandlers,
    // No-op here; global mute toggle is handled in Calls UI
    handleToggleGlobalMute: () => {},
  });

  const { wsConnect, wsDisconnect, isWSConnected } = useWebSocket({
    onAction: handleAction,
    dispatch,
    onConnected: () => {
      setConnectionConflict(false);
    },
    resetLastSentCallsState: () => {},
    onConflict: () => {
      setConnectionConflict(true);
      setIsWSReconnecting(false);
    },
  });

  useWebsocketReconnect({
    calls,
    isMasterInputMuted: false,
    isWSReconnecting,
    isWSConnected,
    isConnectionConflict,
    setIsWSReconnecting,
    wsConnect,
  });

  useEffect(() => {
    // Prefill saved host:port and auto-connect only on mobile app
    try {
      const savedHostPort = window.localStorage.getItem("companionWsHostPort");
      if (savedHostPort) setHostPort(savedHostPort);
      const savedUrl = window.localStorage.getItem("companionWsUrl");
      if (savedUrl && isMobile && !isWSConnected && !isWSReconnecting) {
        setConnectionConflict(false);
        wsConnect(savedUrl);
      }
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const protocol = "ws://";
  const connectCompanion = () => {
    const url = `${protocol}${hostPort}`;
    try {
      window.localStorage.setItem("companionWsHostPort", hostPort);
      window.localStorage.setItem("companionWsUrl", url);
    } catch (_) {}
    setConnectionConflict(false);
    wsConnect(url);
  };

  // Test tone state (moved from DebugPanel)
  const [tone, setTone] = useState<{
    ctx: AudioContext | null;
    stop: (() => void) | null;
  }>({ ctx: null, stop: null });

  const { writeToStorage } = useStorage();

  const applyUserSetting = (key: "audioinput" | "audiooutput", value: string) => {
    // Update react-hook-form state
    setValue(key as any, value);
    // Persist immediately
    try {
      writeToStorage(key, value);
    } catch (_) {}
    // Update global state
    dispatch({
      type: "UPDATE_USER_SETTINGS",
      payload: {
        ...userSettings,
        [key]: value,
      } as TUserSettings,
    });
  };

  // Removed inline permission/debug status in favor of DebugPanel

  useEffect(() => {
    if (production && isJoinProduction) {
      const selectedLine = production.lines.find(
        (line) => line.id.toString() === selectedLineId
      );
      setIsProgramOutputLine(!!selectedLine?.programOutputLine);
      setSelectedLineName(selectedLine?.name ?? "");
    }
  }, [production, selectedLineId, isJoinProduction]);

  // Update selected line id when a new production is fetched
  useEffect(() => {
    // Don't run this hook if we have pre-selected values
    if (preSelected || !isJoinProduction) return;

    if (!production) {
      reset({
        lineId: "",
      });

      return;
    }

    const lineId = production.lines[0]?.id?.toString() || undefined;

    reset({
      lineId,
    });
  }, [preSelected, production, reset, isJoinProduction]);

  useEffect(() => {
    if (defaultValues && "productionId" in defaultValues) {
      setValue("productionId", defaultValues.productionId);
    }
  }, [defaultValues, setValue]);

  useEffect(() => {
    if (defaultValues && "productionId" in defaultValues && productions) {
      setProduction(
        productions?.productions.find(
          (p) => p.productionId === defaultValues.productionId
        ) || null
      );
    }
  }, [defaultValues, productions]);

  // If the device no longer exists set field values to default
  useEffect(() => {
    if (!devices.input?.length) {
      setValue("audioinput", "no-device", { shouldValidate: true });
    }
  }, [devices, setValue]);

  // If user selects a production from the productionlist
  useEffect(() => {
    if (selectedProductionId && isJoinProduction) {
      reset({
        productionId: `${selectedProductionId}`,
      });
    }
  }, [reset, selectedProductionId, isJoinProduction]);

  useSubmitOnEnter<FormValues | TUserSettings>({
    handleSubmit,
    submitHandler: onSubmit,
    needsConfirmation,
    shouldSubmitOnEnter: true,
    isBrowserFirefox,
    setConfirmModalOpen,
  });

  return (
    <div style={{ minWidth: updateUserSettings ? "min(40rem, 100%)" : "" }}>
      {isSettingsConfig && isMobile && (
        <FormItem label="Backend URL" fieldName="backendUrl" errors={errors}>
          <FormInput
            // eslint-disable-next-line
            {...register(`backendUrl` as any, {
              validate: (v) => {
                if (!v) return true;
                try {
                  // Normalize accidental quotes before validating
                  const s = String(v)
                    .trim()
                    .replace(/^['\"]+|['\"]+$/g, "");
                  const parsed = new URL(s);
                  void parsed.href;
                  return true;
                } catch (_) {
                  return "Enter a valid URL (e.g., https://host/)";
                }
              },
            })}
            placeholder="https://your-intercom-manager/"
          />
        </FormItem>
      )}
      {isSettingsConfig && isMobile && (
        <FormItem
          label="Backend API Key"
          fieldName="backendApiKey"
          errors={errors}
        >
          <FormInput
            // eslint-disable-next-line
            {...register(`backendApiKey` as any)}
            type="password"
            placeholder="Optional service access token"
          />
        </FormItem>
      )}
      {isSettingsConfig && isMobile && (
        <FormItem label="Floating Controls">
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <PrimaryButton
              type="button"
              onClick={async () => {
                try {
                  await OverlayBubble.openOverlayPermission();
                } catch (_) {}
              }}
            >
              Open Permission Settings
            </PrimaryButton>
            <PrimaryButton
              type="button"
              onClick={() => setShowDebug((v) => !v)}
            >
              {showDebug ? "Hide Debug Info" : "Show Debug Info"}
            </PrimaryButton>
            {showDebug && (
              <div style={{ width: "100%", marginTop: 8 }}>
                <DebugPanel />
              </div>
            )}
          </div>
        </FormItem>
      )}
      {!preSelected && isJoinProduction && (
        <FormItem label="Production Name" errors={errors}>
          <FormSelect
            // eslint-disable-next-line
            {...register(`productionId`)}
            onChange={(ev) => {
              setProduction(
                productions?.productions.find(
                  (p) => p.productionId === ev.target.value
                ) || null
              );
            }}
          >
            {productions &&
              productions.productions.map((p) => (
                <option key={p.productionId} value={p.productionId}>
                  {p.name}
                </option>
              ))}
          </FormSelect>
          {productionListFetchError && (
            <FetchErrorMessage>
              The production list could not be fetched.
              {productionListFetchError.name} {productionListFetchError.message}
              .
            </FetchErrorMessage>
          )}
        </FormItem>
      )}
      {isSettingsConfig && (
        <FormItem label="Companion (Stream Deck)">
          <div style={{ display: "grid", gap: "0.6rem" }}>
            <div style={{ position: "relative" }}>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "0.6rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9aa3ab",
                  fontSize: "1.4rem",
                  pointerEvents: "none",
                }}
              >
                {protocol}
              </span>
              <FormInput
                style={{ paddingLeft: "5.6rem", marginBottom: 0 }}
                aria-label="WebSocket host and port"
                type="text"
                placeholder="host:port"
                value={hostPort}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  let withoutProtocol = v;
                  if (v.startsWith("ws://")) withoutProtocol = v.slice(5);
                  if (v.startsWith("wss://")) withoutProtocol = v.slice(6);
                  setHostPort(withoutProtocol);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    connectCompanion();
                  }
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              {!isWSConnected ? (
                <PrimaryButton
                  type="button"
                  onClick={connectCompanion}
                  disabled={!hostPort}
                  className={isWSReconnecting ? "with-loader" : ""}
                >
                  {isWSReconnecting ? (
                    <Spinner className="companion-loader" />
                  ) : (
                    "Connect"
                  )}
                </PrimaryButton>
              ) : (
                <PrimaryButton type="button" onClick={wsDisconnect}>
                  Disconnect
                </PrimaryButton>
              )}
              <div style={{ opacity: 0.85 }}>
                Status: {isWSConnected ? "connected" : isWSReconnecting ? "reconnecting" : "disconnected"}
                {isConnectionConflict ? " • conflict" : ""}
              </div>
            </div>
          </div>
        </FormItem>
      )}
      {!preSelected && isJoinProduction && (
        <FormItem label="Line">
          <FormSelect
            // eslint-disable-next-line
            {...register(`lineId`, {
              required: "Line id is required",
              minLength: 1,
              onChange: (e) => {
                const selectedLine = production?.lines.find(
                  (line) => line.id.toString() === e.target.value
                );
                setIsProgramOutputLine(!!selectedLine?.programOutputLine);
              },
            })}
            style={{
              display: production ? "block" : "none",
            }}
          >
            {production &&
              production.lines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name || line.id}
                </option>
              ))}
          </FormSelect>
          {!production && (
            <StyledWarningMessage>
              Please enter a production id
            </StyledWarningMessage>
          )}
        </FormItem>
      )}
      {/* Mobile audio route selection removed to avoid redundancy */}
      <FormItem label="Username" fieldName="username" errors={errors}>
        <FormInput
          // eslint-disable-next-line
          {...register(`username`, {
            required: "Username is required",
            minLength: 1,
          })}
          placeholder="Username"
        />
      </FormItem>
      {(isFirstConnection || isSupportedBrowser || isSettingsConfig) && (
        <>
          <DevicesSection>
            <SectionTitle>
              {isBrowserSafari ? "Device" : "Devices"}
            </SectionTitle>
            {isBrowserFirefox && <FirefoxWarning type="firefox-warning" />}
          </DevicesSection>
          <FormItem label="Audio device">
            <FormSelect
              // eslint-disable-next-line
              {...register(`audioinput`, {
                onChange: (e) => applyUserSetting("audioinput", e.target.value),
              })}
            >
              {devices.input && devices.input.length > 0 ? (
                <>
                  {!devices.input.some((d) => d.deviceId === "default") && (
                    <option value="default">Default</option>
                  )}
                  {devices.input.map((device, idx) => {
                    const label =
                      device.label?.trim() ||
                      (device.deviceId === "default"
                        ? "Default"
                        : `Microphone ${idx + 1}`);
                    return (
                      <option key={device.deviceId} value={device.deviceId}>
                        {label}
                      </option>
                    );
                  })}
                </>
              ) : (
                <option value="no-device">No device available</option>
              )}
            </FormSelect>
          </FormItem>
          {!isBrowserSafari && !isMobile && (
            <FormItem label="Output">
              {devices.output && devices.output.length > 0 ? (
                <FormSelect
                  // eslint-disable-next-line
                  {...register(`audiooutput`, {
                    onChange: (e) => applyUserSetting("audiooutput", e.target.value),
                  })}
                >
                  {!devices.output.some((d) => d.deviceId === "default") && (
                    <option value="default">Default</option>
                  )}
                  {devices.output.map((device, idx) => {
                    const label =
                      device.label?.trim() ||
                      (device.deviceId === "default"
                        ? "Default"
                        : `Output ${idx + 1}`);
                    return (
                      <option key={device.deviceId} value={device.deviceId}>
                        {label}
                      </option>
                    );
                  })}
                </FormSelect>
              ) : (
                <StyledWarningMessage>
                  Controlled by operating system
                </StyledWarningMessage>
              )}
            </FormItem>
          )}

          {/* Test tone at bottom below device selection */}
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.6rem" }}>
            {!tone.ctx ? (
              <PrimaryButton
                type="button"
                onClick={async () => {
                  try {
                    const AudioCtx =
                      (window as any).AudioContext || (window as any).webkitAudioContext;
                    const ctx = new AudioCtx();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.value = 440;
                    gain.gain.value = 0.06;
                    osc.connect(gain).connect(ctx.destination);
                    osc.start();
                    const stop = () => {
                      try {
                        osc.stop();
                      } catch {}
                      try {
                        osc.disconnect();
                      } catch {}
                      try {
                        gain.disconnect();
                      } catch {}
                      try {
                        ctx.close();
                      } catch {}
                      setTone({ ctx: null, stop: null });
                    };
                    setTone({ ctx, stop });
                  } catch {}
                }}
              >
                Play Test Tone
              </PrimaryButton>
            ) : (
              <PrimaryButton
                type="button"
                onClick={() => {
                  try {
                    tone.stop?.();
                  } catch {}
                }}
              >
                Stop Test Tone
              </PrimaryButton>
            )}
          </div>
        </>
      )}
      {isProgramOutputLine && isJoinProduction && (
        <>
          <p>
            This is a line for audio feed. Do you wish to join the line as the
            audio feed or as a listener?
          </p>
          {setIsProgramUser && (
            <CheckboxWrapper>
              <Checkbox
                label="Listener"
                checked={!isProgramUser}
                onChange={() => setIsProgramUser(false)}
              />
              <Checkbox
                label="Audio feed"
                checked={isProgramUser}
                onChange={() => setIsProgramUser(true)}
              />
            </CheckboxWrapper>
          )}
        </>
      )}
      <ButtonWrapper>
        {(isFirstConnection || isSupportedBrowser || isSettingsConfig) && (
          <ReloadDevicesButton />
        )}
        <SubmitButton
          type="button"
          disabled={isJoinProduction ? !isValid : false}
          onClick={
            !needsConfirmation || isBrowserFirefox
              ? handleSubmit(onSubmit)
              : () => setConfirmModalOpen(true)
          }
          shouldSubmitOnEnter
        >
          {buttonText}
        </SubmitButton>
      </ButtonWrapper>

      {confirmModalOpen && (
        <ConfirmationModal
          title="Confirm"
          description="Are you sure you want to update your settings?"
          confirmationText="This will update the devices for all current calls."
          onConfirm={handleSubmit(onSubmit)}
          onCancel={() => setConfirmModalOpen(false)}
          shouldSubmitOnEnter
        />
      )}
    </div>
  );
};
