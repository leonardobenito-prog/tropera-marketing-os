export { default } from "next-auth/middleware";

// Protege todo lo que cuelga de (app). /login y /api/auth quedan fuera
// porque si no, nadie podría ni siquiera llegar a la pantalla de login.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/today/:path*",
    "/calendar/:path*",
    "/campaigns/:path*",
    "/production/:path*",
    "/advertising/:path*",
    "/budget/:path*",
    "/analytics/:path*",
    "/locations/:path*",
    "/team/:path*",
    "/ideas/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
