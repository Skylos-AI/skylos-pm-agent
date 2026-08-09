import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { listChatChannelsForUser } from "@/lib/data/chat";
import { getActiveTeamMembers } from "@/lib/data/tasks";
import { ChatChannelList } from "@/components/pm/chat-channel-list";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [channels, teamMembers] = await Promise.all([
    listChatChannelsForUser(user.id),
    getActiveTeamMembers(),
  ]);
  const others = teamMembers.filter((m) => m.id !== user.id);

  return (
    <div className="min-h-screen flex">
      <ChatChannelList
        channels={channels}
        currentUserId={user.id}
        teamMembers={others}
      />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
