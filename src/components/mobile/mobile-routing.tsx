import { Route, useLocation, useNavigate, type Location } from "react-router";
import { isMobileApp } from "../../platform";
import { CallsPage } from "../calls-page/calls-page";
import { ManageProductionsPage } from "../manage-productions-page/manage-productions-page";
import { MobileSettingsPage } from "./MobileSettingsPage";

export const useMobileBackgroundLocation = (location: Location) => {
  if (!isMobileApp()) return null;
  return (
    (location.state as { backgroundLocation?: Location } | null)
      ?.backgroundLocation ?? null
  );
};

export const useMobileSettingsNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isMobileApp()) return undefined;

  return () =>
    navigate("/settings", {
      state: { backgroundLocation: location },
    });
};

export const renderMobileRoutes = () => {
  if (!isMobileApp()) return null;

  return (
    <>
      <Route path="/manage-productions" element={<ManageProductionsPage />} />
      <Route
        path="/production-calls/production/:productionId/line/:lineId"
        element={<CallsPage />}
      />
      <Route path="/settings" element={<MobileSettingsPage />} />
    </>
  );
};
