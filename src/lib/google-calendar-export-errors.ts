/**
 * Complète les erreurs brutes renvoyées par Google lors de l'export Agenda (messages plus lisibles).
 */
export function explainGoogleCalendarExportFailure(sampleErrors: string[]): string | null {
  const blob = sampleErrors.join(" ").toLowerCase();
  if (
    blob.includes("calendar-json.googleapis.com") ||
    blob.includes("calendar api has not been used") ||
    blob.includes("api has not been used in project")
  ) {
    return (
      "Action administrateur : dans Google Cloud Console, ouvrez le projet associé à vos variables GOOGLE_OAUTH_CLIENT_ID / SECRET, " +
      "menu APIs et services > Bibliothèque, puis activez « Google Calendar API ». Attendez 2 à 5 minutes et réessayez l’export."
    );
  }
  if (blob.includes("insufficient authentication scopes") || blob.includes("insufficient scopes")) {
    return "Reconnectez votre compte Google depuis Réglages > Google Agenda pour accepter les autorisations calendrier.";
  }
  if (blob.includes("401") || blob.includes("invalid_credentials")) {
    return "Jeton Google expiré ou révoqué : reliancez le compte dans Réglages > Google Agenda.";
  }
  return null;
}
