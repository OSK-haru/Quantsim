import './HelpPage.css'

type HelpPageProps = {
  onBackToSimulation: () => void
}

const helpItems = [
  {
    question: 'What is State Fidelity?',
    answer:
      'State fidelity measures how close the noisy result is to the ideal result. A value near 1 means the state stayed close to the target, while a lower value means the state drifted away more strongly. In this app, fidelity is the main signal for how quickly the circuit loses effectiveness.',
  },
  {
    question: 'What is Purity?',
    answer:
      'Purity shows how clean or mixed the quantum state is. A pure state has purity near 1, while a mixed state has a lower value. Purity can stay fairly high even when fidelity starts to fall, because the state can remain orderly while still moving away from the ideal target.',
  },
  {
    question: 'What is Effective Operation Time?',
    answer:
      'Effective operation time is the first time the fidelity drops below the threshold. It gives a simple answer to the question, "How long does the circuit stay usable?" In this app, a shorter effective time means the environment is degrading the circuit more quickly.',
  },
  {
    question: 'Why can Fidelity be low while Purity is high?',
    answer:
      'Fidelity and purity measure different things. Fidelity checks closeness to the ideal target, while purity checks how mixed the state is. A state can still be fairly clean and ordered, but point in the wrong direction compared with the ideal result.',
  },
  {
    question: 'Why does high noise reduce Fidelity?',
    answer:
      'Noise adds random disturbance to the state as it evolves. That disturbance makes the result drift away from the ideal trajectory more quickly. In this simplified model, higher noise usually means faster fidelity loss and a shorter usable time.',
  },
  {
    question: 'What is the difference between completion fidelity and final fidelity?',
    answer:
      'Completion fidelity measures the state when the intended operation is considered complete. Final fidelity measures the state at the end of the whole simulated timeline. They can be different when the state keeps evolving after the gate has finished.',
  },
  {
    question: 'What model is QuantaScope using?',
    answer:
      'QuantaScope uses an educational weak-coupling open-system simulation. It uses gate-aware Lindblad-style evolution for a one-qubit H-gate model and maps environment settings into simple T1 and T2 lifetimes. The goal is to show trends under the chosen model, not to reproduce every hardware detail.',
  },
  {
    question: 'Is this a hardware-accurate simulator?',
    answer:
      'No. It is a simplified teaching model, not strict hardware calibration. The results suggest trends under the chosen assumptions, but they are not exact predictions for any specific device.',
  },
  {
    question: 'What should I try when fidelity drops?',
    answer:
      'First compare a low-noise run with a high-noise run and watch how the effective time changes. If fidelity drops quickly, lower the noise level first, then compare temperature and magnetic field changes. The point is to see which condition is pushing the state away from the ideal result most strongly.',
  },
]

export function HelpPage({ onBackToSimulation }: HelpPageProps) {
  return (
    <main className="help-page">
      <header className="help-page__header">
        <div>
          <div className="help-page__eyebrow">QuantaScope</div>
          <h1>Help / Q&amp;A</h1>
          <p className="help-page__lede">
            Short answers for reading the simulation screen, comparing metrics, and
            understanding why the result changes.
          </p>
        </div>
        <button className="help-page__back" type="button" onClick={onBackToSimulation}>
          Back to simulation
        </button>
      </header>

      <section className="help-page__intro" aria-label="Model note">
        <p>
          These answers describe the simplified one-qubit model used by the app.
          The simulation is educational, gate-aware, and built to show trends under
          the chosen environment settings.
        </p>
      </section>

      <section className="help-page__grid" aria-label="Help questions">
        {helpItems.map((item) => (
          <article className="help-page__card" key={item.question}>
            <h2 className="help-page__question">{item.question}</h2>
            <p className="help-page__answer">{item.answer}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
