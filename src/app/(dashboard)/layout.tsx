import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
    return (
        <div className="flex h-dvh">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Header />
                <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}