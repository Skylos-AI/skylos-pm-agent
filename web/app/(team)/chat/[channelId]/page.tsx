import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getChatChannel, getChatMessages } from "@/lib/data/chat";
import { ChatRoom } from "@/components/pm/chat-room";

export default async function ChatChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { channelId } = await params;

  const channel = await getChatChannel(channelId, user.id);
  if (!channel) notFound();
  const initialMessages = await getChatMessages(channelId, 100);

  const title =
    channel.kind === "GROUP"
      ? (channel.name ?? "Canal")
      : (channel.members.find((m) => m.user_id !== user.id)?.full_name ??
        "Mensaje directo");

  return (
    <ChatRoom
      channelId={channel.id}
      channelKind={channel.kind}
      title={title}
      members={channel.members}
      currentUserId={user.id}
      initialMessages={initialMessages}
    />
  );
}
