const timeZone = 'Asia/Tokyo';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeZone,
});

const isoDateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone,
});

export const formatDate = (date: Date) => dateFormatter.format(date);

export const formatIsoDate = (date: Date) => {
  const parts = Object.fromEntries(
    isoDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
};
