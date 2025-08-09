import { getSession, signOut } from "@/features/auth";
import { SSEClient, WelcomeMessage } from "@/features/home";

const HomePage = async () => {
  const session = await getSession();

  const handleSignOut = async () => {
    "use server";
    await signOut();
  };

  return (
    <>
      <WelcomeMessage name={session?.user.name ?? ""} signOut={handleSignOut} />
      <SSEClient />
    </>
  );
};

export default HomePage;
