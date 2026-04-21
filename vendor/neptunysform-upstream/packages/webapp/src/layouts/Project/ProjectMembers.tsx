import { Avatar } from '@/components'
import { useWorkspaceStore } from '@/store'

export default function ProjectMembers() {
  const { workspace } = useWorkspaceStore()

  return (
    <div className="mt-2">
      <div className="flex items-center -space-x-2">
        <Avatar
          className="ring-foreground h-9 w-9 rounded-full ring-2"
          src={workspace?.avatar}
          fallback={workspace?.name}
          resize={{ width: 100, height: 100 }}
        />
      </div>
    </div>
  )
}
