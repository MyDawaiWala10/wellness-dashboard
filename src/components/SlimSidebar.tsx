"use client";

import Avatar from '@/assests/avatars/avatar2.svg'
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  Home,
  Inbox,
  FileText,
  PanelLeft,
  Package,
  PhoneMissed,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModeToggle } from "./theme-mode/mode-toggle";
import { usePathname, useRouter } from "next/navigation";
import { LogoutButton } from './auth/logout-button';
import { useAuthStore } from '@/providers/permission-provider';
import InboundBookingNotifier from './InboundBookingNotifier';

const navLinks = [
  {
    title: "Dasboard",
    icon: <Home className="h-5 w-5" />,
    href: "/dashboard",
  },
  {
    title: "Enquiries",
    icon: <Inbox className="h-5 w-5" />,
    href: "/dashboard/enquiries",
  },
  {
    title: "Follow-ups",
    icon: <PhoneMissed className="h-5 w-5" />,
    href: "/dashboard/follow-ups",
  },
  {
    title: "Customers",
    icon: <Users className="h-5 w-5" />,
    href: "/dashboard/customers",
  },
  {
    title: "Analytics",
    icon: <BarChart3 className="h-5 w-5" />,
    href: "/dashboard/analytics",
  },
  {
    title: "Invoices",
    icon: <FileText className="h-5 w-5" />,
    href: "/dashboard/invoices",
  },
  {
    title: "Services",
    icon: <Package className="h-5 w-5" />,
    href: "/dashboard/services",
  },
  {
    title: "Book Slot",
    icon: <CalendarClock className="h-5 w-5" />,
    href: "/dashboard/appointments",
  },
  {
    title: "Therapist List",
    icon: <UserPlus className="h-5 w-5" />,
    href: "/dashboard/alltherapist",
  },
  {
    title: "Earnings",
    icon: <Wallet className="h-5 w-5" />,
    href: "/dashboard/earnings",
  },
];

function formatRole(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

const SlimSidebar = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const {user} = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  /**
   * Array of all pathname variables, example: if pathname is "/dashboard/orders" then PATH_NAME will be ["dashboard", "orders"]
   * it is to help show the user location with breadcrums
   * @type {string[]}
   */
  let PATH_NAMES = pathname.split("/");
  PATH_NAMES = PATH_NAMES.splice(1, PATH_NAMES.length);

  // Role scoping: therapists only see their own work.
  const router = useRouter();
  const role = user?.role;
  const THERAPIST_NAV = new Set(["/dashboard", "/dashboard/appointments", "/dashboard/earnings", "/dashboard/alltherapist"]);
  const THERAPIST_ALLOWED = new Set([
    "/dashboard",
    "/dashboard/appointments",
    "/dashboard/settings",
    "/dashboard/earnings",
    "/dashboard/alltherapist",
  ]);
  const visibleLinks =
    role === "THERAPIST"
      ? navLinks.filter((l) => THERAPIST_NAV.has(l.href))
      : navLinks;

  useEffect(() => {
    if (role === "THERAPIST" && !THERAPIST_ALLOWED.has(pathname)) {
      router.replace("/dashboard/appointments");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, pathname]);

  return (
    <>
      <InboundBookingNotifier />
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 h-screen flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-4 mt-10 ">
          <TooltipProvider>
            {visibleLinks.map((navItems, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Link
                    href={navItems.href}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8 ${
                      pathname === navItems.href ? `bg-accent` : ""
                    } `}
                  >
                    {navItems.icon}
                    <span className="sr-only">{navItems.title}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{navItems.title}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <ModeToggle />
                  <span className="sr-only">Theme</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Theme</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/settings"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
                >
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
      </aside>
      <div className="h-screen flex flex-col sm:gap-4 sm:py-4 sm:pl-14 overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs">
              <nav className="grid gap-6 text-lg font-medium mt-12 ">
                {visibleLinks.map((navItems, index) => (
                  <Link
                    key={index}
                    href={navItems.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`${
                      pathname === navItems.href ? "bg-accent" : " "
                    } flex items-center gap-4 py-1 px-2.5 text-muted-foreground  hover:text-foreground rounded-lg`}
                  >
                    {navItems.icon}
                    {navItems.title}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          {/* Update this with real pathname */}
          <Breadcrumb className="hidden md:flex">
            <BreadcrumbList>
              {PATH_NAMES.map((path, index) => (
                <span
                  key={index}
                  className="flex items-center justify-center gap-1"
                >
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        href={
                          index > 1
                            ? `${PATH_NAMES[index - 1]}/${PATH_NAMES[index]}`
                            : PATH_NAMES[index]
                        }
                        className=" flex items-center capitalize"
                      >
                        {PATH_NAMES[index]}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="pt-[2px]" />
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="relative ml-auto flex-1 md:grow-0">
            {/* <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
            /> */}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                  <Image
                    src={Avatar}
                    width={36}
                    height={36}
                    alt="Avatar"
                    className="overflow-hidden rounded-full bg-muted"
                  />   
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex flex-col gap-0.5 max-w-56">
                <span className="font-medium truncate min-w-0">
                  {user ? `${user.userfName} ${user.userlName}` : "My Account"}
                </span>
                {user && (
                  <>
                    <span className="text-xs font-normal text-muted-foreground truncate min-w-0">
                      {user.userEmail}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground truncate min-w-0">
                      {formatRole(user.role)}
                    </span>
                  </>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
                <Link href="/dashboard/settings">
              <DropdownMenuItem className=' cursor-pointer'>
                Settings
              </DropdownMenuItem>
                </Link>
              <DropdownMenuItem className=' cursor-not-allowed'>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className=' cursor-pointer'>
                <LogoutButton/>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <div className='px-5 overflow-y-auto' >
        {children}
        </div>
      </div>
    </>
  );
};

export default SlimSidebar;
