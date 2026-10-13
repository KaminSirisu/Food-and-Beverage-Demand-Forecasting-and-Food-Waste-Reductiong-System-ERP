import {
    Bell,
    ChartLine,
    House,
    SlidersVertical,
    Tag,
    type LucideIcon 
} from "lucide-react";

export type NavItem = {
    label: string;
    href: string;
    icon: LucideIcon;
    badge?: number;
}

export type NavSection = {
    title: string;
    items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
    {
        title: "Store Manager",
        items: [
            { label: "Dashboard & Pre-Rush Alerts", href: "/", icon: House },
            { label: "Forecast vs. Actual Analytics", href: "/analytics", icon: ChartLine },
            { label: "Waste & Auto-Promotion Engine", href: "/promotions", icon: Tag },
            { label: "Branch Thresholds & Checkpoints", href: "/thresholds", icon: SlidersVertical },
        ]
    },
    {
        title: "System",
        items: [
            { label: "Notifications", href:"/notifications", icon: Bell, badge: 5 },
        ],
    },
];

