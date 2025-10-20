export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  let decodedPathname = url.pathname;
  try {
    decodedPathname = decodeURIComponent(url.pathname);
  } catch (error) {
    // If decoding fails, fall back to the original pathname so the request can continue.
  }

  url.pathname = decodedPathname.normalize('NFC');

  const assetRequest = new Request(url.toString(), context.request);
  const assetResponse = await context.env.ASSETS.fetch(assetRequest);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  return context.next();
}
