import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { getCurrentUser } from "@/lib/auth/dal";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser(); // G2 / NFR4: real auth check — proxy.ts is only optimistic

    return (
        <div className="flex h-dvh">
            <Sidebar user={user}/>
            <div className="flex min-w-0 flex-1 flex-col">
                <Header user={user}/>
                <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}