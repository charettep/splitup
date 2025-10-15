import { Calendar, Receipt, Home, TableCellsSplit, FileText } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useSettlement } from "@/lib/settlementContext";

const menuItems = [
  {
    title: "Split Periods",
    path: "split-periods",
    icon: Calendar,
  },
  {
    title: "Expenses",
    path: "expenses",
    icon: Receipt,
  },
  {
    title: "Assets",
    path: "assets",
    icon: Home,
  },
  {
    title: "Ledger",
    path: "ledger",
    icon: TableCellsSplit,
  },
  {
    title: "Import/Export",
    path: "import-export",
    icon: FileText,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { settlement, person1, person2 } = useSettlement();
  
  const baseUrl = `/settle/${settlement.name}`;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <h2 className="font-semibold text-lg">{settlement.name}</h2>
        <p className="text-xs text-muted-foreground">
          {person1?.personName} & {person2?.personName || "Pending"}
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const url = `${baseUrl}/${item.path}`;
                const isActive = location === url || location.startsWith(url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link href={url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
