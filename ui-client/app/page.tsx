export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="glass-card p-10 max-w-lg text-center">
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          LTI Tool Provider
        </h1>
        <p className="text-gray-300 mb-8">
          This is an LTI 1.3 Advantage Tool. Please launch this application from
          your Learning Management System (LMS).
        </p>
      </div>
    </main>
  );
}
