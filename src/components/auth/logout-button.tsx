"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/user/logout";
import { useAuthStore } from "@/providers/permission-provider";
import { disablePushAlerts } from "@/lib/push-alerts";

export const LogoutButton = () => {
  const router = useRouter();

  const handleLogout = async () => {
    // While still logged in, so the server lets it remove this device.
    await disablePushAlerts();
    await logoutAction();
    useAuthStore.getState().logout(); 
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <Button variant="ghost" onClick={handleLogout}>
      Logout
    </Button>
  );
};
