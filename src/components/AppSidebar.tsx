import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
    useSidebar
} from "@/components/ui/sidebar"
import { Home, LayoutDashboard, Settings, User, Users } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

export function AppSidebar() {
    const { state } = useSidebar()
    const location = useLocation()
    const pathname = location.pathname

    return (
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center gap-2 px-2 p-3">
                    <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-white">
                        W
                    </div>
                    {state === "expanded" && <span className="font-semibold">Whagons</span>}
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>

                    {/* Main Menu Group */}
                    <SidebarGroupLabel className="text-sm font-normal">Main Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="font-sm text-gray-700">
                            <SidebarMenuItem
                                className="pt-1 pb-1"
                            >
                                <SidebarMenuButton 
                                    asChild 
                                    tooltip="Home" 
                                    isActive={pathname === "/tasks"}
                                    className="h-10"
                                >
                                    <Link to="/">
                                        <Home 
                                            size={20}
                                            className="w-5! h-5!"
                                        />
                                        <span
                                        >Home</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem
                                className="pt-1 pb-1"
                            >
                                <SidebarMenuButton 
                                    asChild 
                                    tooltip="Dashboard" 
                                    isActive={pathname === "/dashboard"}
                                    className="h-10"
                                >
                                    <Link to="/dashboard">
                                        <LayoutDashboard 
                                            size={20}
                                            className="w-5! h-5!"
                                        />
                                        <span
                                        >Dashboard</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarSeparator />
                <SidebarGroup>
                    <SidebarGroupLabel className="text-sm font-normal">Management</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="text-gray-700">
                            <SidebarMenuItem
                                className="pt-1 pb-1"
                            >
                                <SidebarMenuButton 
                                    asChild 
                                    tooltip="Users" 
                                    isActive={pathname === "/users"}
                                    className="h-10"
                                >
                                    <Link to="/users">
                                        <Users 
                                            size={20}
                                            className="w-5! h-5!"
                                        />
                                        <span
                                        >Users</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem
                                className="pt-1 pb-1"
                            >
                                <SidebarMenuButton 
                                    asChild 
                                    tooltip="Profile" 
                                    isActive={pathname === "/profile"}
                                    className="h-10"
                                >
                                    <Link to="/profile">
                                        <User 
                                            size={20}
                                            className="w-5! h-5!"
                                        />
                                        <span
                                        >Profile</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem
                                className="pt-1 pb-1"
                            >
                                <SidebarMenuButton 
                                    asChild 
                                    tooltip="Settings" 
                                    isActive={pathname === "/settings"}
                                    className="h-10"
                                >
                                    <Link to="/settings">
                                        <Settings 
                                            size={20}
                                            className="w-5! h-5!"
                                        />
                                        <span
                                        >Settings</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <div className="px-2 py-1 text-xs text-sidebar-foreground/70">
                    Version 5.0.0
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
  