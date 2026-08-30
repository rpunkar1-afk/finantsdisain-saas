import type { AppProps } from "next/app";
import Link from "next/link";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <nav className="nav">
        <Link href="/">Finantsdisain AI</Link>
        <Link href="/vke">VKE</Link>
        <Link href="/ky">KÜ</Link>
        <Link href="/grants">Toetused</Link>
      </nav>
      <Component {...pageProps} />
    </>
  );
}
