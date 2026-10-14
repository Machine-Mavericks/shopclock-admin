import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
    },
    {
      path: "/",
      name: "students",
      component: () => import("../views/StudentListView.vue"),
    },
    {
      path: "/students/:id",
      name: "student-detail",
      component: () => import("../views/StudentDetailView.vue"),
      props: true,
    },
    {
      path: "/attendance",
      name: "attendance",
      component: () => import("../views/AttendanceView.vue"),
    },
    {
      path: "/admins",
      name: "admins",
      component: () => import("../views/AdminsView.vue"),
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("../views/NotFoundView.vue"),
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.ensureLoaded();

  if (to.name !== "login" && to.name !== "not-found" && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.name === "login" && auth.isAuthenticated) {
    return { name: "students" };
  }

  return true;
});

export default router;
