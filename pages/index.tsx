import { GetServerSideProps } from "next";
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/coldline", permanent: false },
});
export default function Home() { return null; }

