export type RuntimeEnv = {
  convexUrl?: string;
  convexAdminSecret?: string;
  modalRunnerUrl?: string;
  demoAdminPassword?: string;
};

export function getRuntimeEnv(): RuntimeEnv {
  return {
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
    convexAdminSecret: process.env.CONVEX_ADMIN_SECRET,
    modalRunnerUrl: process.env.MODAL_RUNNER_URL,
    demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD,
  };
}

export function getMissingEnv(keys: string[]): string[] {
  return keys.filter((key) => !process.env[key]);
}
