import { OfflineTrainingPage } from "@/componentes/offline-training";
export const metadata = { title: "BM Training sin conexión", robots: { index: false, follow: false } };
// Public shell only. All student data lives in the device's scoped IndexedDB stores.
export default function Page() { return <OfflineTrainingPage />; }
