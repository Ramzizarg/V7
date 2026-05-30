import { getHomeContentServer } from "@/lib/homeContent";
import HomePageClient from "./HomePageClient";

/** Server-fetched CMS content → correct hero on first paint after reload. */
export default async function Home() {
  const initialHomeContent = await getHomeContentServer();
  return <HomePageClient initialHomeContent={initialHomeContent} />;
}
