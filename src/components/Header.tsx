import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";

function Header() {
    return ( 
        <header className="sticky top-0 z-10 bg-background border-b">
            <div className="flex items-center justify-between h-14 px-4">
                <div className="flex items-center">
                    <SidebarTrigger className="mr-4" />
                    <h1 className="font-medium">Header</h1>
                </div>
                <div className="flex items-center gap-4">
                    {/* Navigation or user menu items would go here */}
                    <Avatar>
                        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                        <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                </div>
            </div>
        </header>
    );
}

export default Header;