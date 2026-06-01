import { SubmitHandler } from "react-hook-form";
import { useGlobalState } from "../../global-state/context-provider";
import { useInitiateProductionCall } from "../../hooks/use-initiate-production-call";
import { useStorage } from "../accessing-local-storage/access-local-storage";
import { TJoinProductionOptions, TProduction } from "../production-line/types";
import {
  defaultSettingsSubmit,
  type UserSettingsFormAdapter,
  type UserSettingsFormPayload,
} from "./user-settings-form-adapter";

export const useSubmitForm = ({
  isJoinProduction,
  production,
  isProgramUser,
  setJoinProductionOptions,
  customGlobalMute,
  closeAddCallView,
  updateUserSettings,
  onSave,
  selectedLineName,
  productionName,
  settingsAdapter,
}: {
  isJoinProduction?: boolean;
  production: TProduction | null;
  isProgramUser?: boolean;
  setJoinProductionOptions?: React.Dispatch<
    React.SetStateAction<TJoinProductionOptions | null>
  >;
  customGlobalMute?: string;
  closeAddCallView?: () => void;
  updateUserSettings?: boolean;
  onSave?: () => void;
  selectedLineName?: string;
  productionName?: string;
  settingsAdapter?: UserSettingsFormAdapter;
}) => {
  const [{ userSettings }, dispatch] = useGlobalState();
  const { writeToStorage, removeFromStorage } = useStorage();
  const { initiateProductionCall } = useInitiateProductionCall({
    dispatch,
  });

  const onSubmit: SubmitHandler<UserSettingsFormPayload> = (payload) => {
    if (isJoinProduction && "lineId" in payload) {
      const selectedLine = production?.lines.find(
        (line) => line.id === payload.lineId
      );

      const resolvedAudioInput =
        payload?.audioinput && payload.audioinput !== "no-device"
          ? payload.audioinput
          : (userSettings?.audioinput ?? "default");

      const options: TJoinProductionOptions = {
        ...payload,
        username: payload.username || userSettings?.username || "",
        audioinput: resolvedAudioInput,
        lineUsedForProgramOutput: selectedLine?.programOutputLine || false,
        isProgramUser: isProgramUser || false,
        lineName: selectedLineName || selectedLine?.name,
        productionName: productionName || production?.name,
      };

      const callPayload = {
        joinProductionOptions: options,
        audiooutput: payload.audiooutput || userSettings?.audiooutput,
      };

      initiateProductionCall({
        payload: callPayload,
        customGlobalMute,
      });

      if (closeAddCallView) {
        closeAddCallView();
      }

      setJoinProductionOptions?.(options);
    }

    if (updateUserSettings || !isJoinProduction) {
      const submitSettings =
        settingsAdapter?.onSubmitSettings ?? defaultSettingsSubmit;
      submitSettings(payload, {
        userSettings,
        dispatch,
        writeToStorage,
        removeFromStorage,
      });
    }

    if (onSave) onSave();
  };

  return { onSubmit };
};
