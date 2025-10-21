import { useEffect, useState } from "react";
import { ProductionsListContainer } from "./productions-list-container.tsx";
import { useGlobalState } from "../../global-state/context-provider.tsx";
import { UserSettings } from "../user-settings/user-settings.tsx";
import { UserSettingsButton } from "./user-settings-button.tsx";
import { isMobile } from "../../bowser.ts";

export const LandingPage = ({
  setApiError,
}: {
  setApiError: (value: boolean) => void;
}) => {
  const [{ apiError }] = useGlobalState();
  const [showSettings, setShowSettings] = useState<boolean>(false);

  useEffect(() => {
    setApiError(!!apiError);
  }, [apiError, setApiError]);

  return (
    <div>
      {showSettings ? (
        <UserSettings
          buttonText="Save"
          className={isMobile ? "" : "desktop"}
          onSave={() => setShowSettings(false)}
        />
      ) : (
        <>
          <UserSettingsButton onClick={() => setShowSettings(true)} />
          <ProductionsListContainer />
        </>
      )}
    </div>
  );
};
