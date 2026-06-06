const PUBLIC_QUERY_PREFIXES = new Set([
  "public-wedding-profile",
  "public-user-wedflix",
  "share-home",
]);

export function clearAuthScopedCache(queryClient) {
  queryClient.removeQueries({
    predicate: (query) => {
      const [prefix] = query.queryKey || [];
      return prefix !== "session" && !PUBLIC_QUERY_PREFIXES.has(prefix);
    },
  });
}

export async function refreshAuthState(queryClient) {
  await queryClient.invalidateQueries({ queryKey: ["session"] });
  await queryClient.refetchQueries({ queryKey: ["session"] });
}
