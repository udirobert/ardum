import EpisodeWorkbench from "@/episodes/EpisodeWorkbench";

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EpisodeWorkbench episodeId={id} />;
}
