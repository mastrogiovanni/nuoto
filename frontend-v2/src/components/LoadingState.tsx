interface Props {
  text?: string
}

export default function LoadingState({ text = 'Caricamento...' }: Props) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  )
}
