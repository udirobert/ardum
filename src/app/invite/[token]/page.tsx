import InviteResponse from "./InviteResponse";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteResponse token={token} />;
}
