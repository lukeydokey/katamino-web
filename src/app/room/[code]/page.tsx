import { RoomPageClient } from "@/components/katamino/room-page-client";

interface RoomPageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ seat?: string }>;
}

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { code } = await params;
  const { seat } = await searchParams;

  return <RoomPageClient roomCode={code} seat={seat} />;
}
