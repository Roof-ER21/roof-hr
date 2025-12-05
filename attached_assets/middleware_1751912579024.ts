
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth?.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth");

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return null;
    }

    if (!isAuth) {
      let from = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        from += req.nextUrl.search;
      }

      return NextResponse.redirect(
        new URL(`/auth/signin?from=${encodeURIComponent(from)}`, req.url)
      );
    }

    // Role-based access control
    const userRole = token?.role as string;
    const pathname = req.nextUrl.pathname;

    // Admin/Manager/Recruiter only routes
    const adminRoutes = ["/employees", "/recruitment", "/files", "/settings"];
    const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

    if (isAdminRoute && !["ADMIN", "MANAGER", "RECRUITER"].includes(userRole)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Admin only routes
    const superAdminRoutes = ["/settings"];
    const isSuperAdminRoute = superAdminRoutes.some(route => pathname.startsWith(route));

    if (isSuperAdminRoute && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employees/:path*",
    "/recruitment/:path*",
    "/pto/:path*",
    "/files/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/auth/:path*"
  ]
};
