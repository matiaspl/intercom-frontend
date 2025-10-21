import { FC } from "react";
import { UserSettings } from "./user-settings";

export const UserSettingsPage: FC = () => {
  return (
    <UserSettings buttonText="Save" needsConfirmation />
  );
};

