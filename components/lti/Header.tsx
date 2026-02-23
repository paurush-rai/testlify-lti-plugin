import type { User } from "@/types/lti";

interface HeaderProps {
  readonly user: User | null;
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Testlify</h1>
          </div>

          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="text-sm">
                <div className="font-medium text-gray-900">
                  {user?.context?.context?.title || "Course"}
                </div>
                <div className="text-xs text-gray-500">
                  ID : {user?.context?.context?.id}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-gray-900">
                  {user?.name || "User"}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.roles?.[0]?.split("#").pop() || "Student"}
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold border-2 border-brand-200">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
