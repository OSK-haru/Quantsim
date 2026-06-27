import './HomePage.css'

type HomePageProps = {
  onStartSimulation: () => void
}

const featureBullets = [
  'Gate-aware Lindblad dynamics',
  'Python dense stable backend',
  'Rust dense preview backend',
  'Future CPTP mode planned',
]

export function HomePage({ onStartSimulation }: HomePageProps) {
  return (
    <main className="home-page">
      <section className="home-page__hero">
        <div className="home-page__eyebrow">QuantaScope</div>
        <h1>QuantaScope</h1>
        <p className="home-page__subtitle">
          Gate-aware open quantum system simulator
        </p>
        <p className="home-page__lede">
          A small educational simulator for visualizing gate-aware Lindblad
          open-system dynamics with Python and Rust preview backends.
        </p>
        <ul className="home-page__features" aria-label="Features">
          {featureBullets.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <button className="home-page__button" type="button" onClick={onStartSimulation}>
          Start simulation
        </button>
      </section>
    </main>
  )
}
