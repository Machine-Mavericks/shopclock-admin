import { defineStore } from "pinia";
import { fetchCurrentAdmin, localLogin as apiLocalLogin, logout as apiLogout, type CurrentAdmin } from "../api/auth";

interface AuthState {
  admin: CurrentAdmin | null;
  loaded: boolean;
  loading: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    admin: null,
    loaded: false,
    loading: false,
  }),
  getters: {
    isAuthenticated(state): boolean {
      return state.admin !== null;
    },
  },
  actions: {
    async ensureLoaded(): Promise<void> {
      if (this.loaded) {
        return;
      }

      await this.refresh();
    },

    async refresh(): Promise<void> {
      this.loading = true;

      try {
        this.admin = await fetchCurrentAdmin();
      } catch {
        this.admin = null;
      } finally {
        this.loaded = true;
        this.loading = false;
      }
    },

    async loginWithPassword(username: string, password: string): Promise<void> {
      const result = await apiLocalLogin(username, password);
      this.admin = { provider: "local", username: result.username, avatar: null };
      this.loaded = true;
    },

    async logout(): Promise<void> {
      await apiLogout().catch(() => undefined);
      this.admin = null;
      this.loaded = true;
    },
  },
});
