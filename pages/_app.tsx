import type { AppProps } from "next/app";
import Link from "next/link";
import { useRouter } from "next/router";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isActive = (href: string) => router.pathname === href;

  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <Link href="/" className="nav-brand">
            <span className="nav-mark" aria-hidden="true" />
            Finantsdisain AI
          </Link>
          <div className="nav-links">
            <Link href="/tooruum" className={isActive("/tooruum") ? "active" : ""}>
              Tööruum
            </Link>
            <Link href="/vke" className={isActive("/vke") ? "active" : ""}>
              VKE
            </Link>
            <Link href="/ky" className={isActive("/ky") ? "active" : ""}>
              KÜ
            </Link>
            <Link href="/grants" className={isActive("/grants") ? "active" : ""}>
              Toetused
            </Link>
          </div>
        </div>
        <Link href="/peeter" className="button small">
          Alusta
        </Link>
      </nav>
      <Component {...pageProps} />
    </>
  );
}
