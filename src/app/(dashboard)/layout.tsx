import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { getCurrentUser } from "@/lib/auth/dal";
import { readFlash } from "@/lib/flash";
import { FlashToast } from "./_components/FlashToast";
import { getSyncStatus } from "@/lib/dashboard/queries";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser(); // G2 / NFR4: real auth check — proxy.ts is only optimistic
    const [flash, sync] = await Promise.all([ readFlash(), getSyncStatus() ]);

    return (
        <div className="flex h-dvh">
            <FlashToast flash={flash} name={user.name} />
            <Sidebar user={user}/>
            <div className="flex min-w-0 flex-1 flex-col">
                <Header user={user} sync={sync} />
                <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}