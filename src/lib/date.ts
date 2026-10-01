const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'long',
  timeZone: 'Asia/Tokyo',
});

export const formatDate = (date: Date) => dateFormatter.format(date);
export const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);
