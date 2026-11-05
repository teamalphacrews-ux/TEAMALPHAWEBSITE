import useDriveMedia from "./useDriveMedia";

export default function ProtectedDriveImage({ file, className }) {
  const { url, error } = useDriveMedia(file.id, true);
  if (error)
    return (
      <div
        className="min-h-40 flex items-center justify-center p-6 text-sm text-gray-600"
        role="status"
      >
        Preview unavailable. Open the asset to try the original.
      </div>
    );
  if (!url)
    return (
      <div
        className="aspect-[3/4] bg-gray-100 animate-pulse"
        aria-label={`Loading ${file.name}`}
      />
    );
  return <img src={url} alt={file.name} className={className} />;
}
