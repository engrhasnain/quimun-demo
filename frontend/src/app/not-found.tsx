import Link from "next/link";

export default function NotFound() {
  return (
    <div className="content">
      <section className="card" style={{ maxWidth: 460 }}>
        <div className="card-body stack">
          <h2 className="card-title">404</h2>
          <p className="card-note">
            Esa residencia no existe en el portafolio. / That residence is not in the portfolio.
          </p>
          <div>
            <Link href="/residencias" className="btn">
              Ver residencias / View residences
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
