export function disposeObject3D(object) {
  if (!object) return;
  object.parent?.remove(object);
  object.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) {
      node.material.forEach((material) => material.dispose?.());
    } else {
      node.material?.dispose?.();
    }
  });
}
