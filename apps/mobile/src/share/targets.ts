export function whatsappUrl(text: string): string {
  return `whatsapp://send?text=${encodeURIComponent(text)}`;
}

export function telegramUrl(text: string): string {
  return `tg://msg?text=${encodeURIComponent(text)}`;
}

export function slackUrl(text: string): string {
  return `https://slack.com/share?text=${encodeURIComponent(text)}`;
}

export function teamsUrl(text: string): string {
  return `https://teams.microsoft.com/share?msgText=${encodeURIComponent(text)}`;
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
