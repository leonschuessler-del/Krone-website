import { forwardRef, type CSSProperties, type ImgHTMLAttributes } from "react";
import { assetUrl } from "./assets";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | { src: string };
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  placeholder?: string;
  blurDataURL?: string;
  unoptimized?: boolean;
  loader?: unknown;
  overrideSrc?: string;
}

const Image = forwardRef<HTMLImageElement, Props>(function Image(
  { src, alt = "", fill, priority, quality: _q, placeholder: _p, blurDataURL: _b, unoptimized: _u, loader: _l, overrideSrc: _o, sizes: _s, style, width, height, loading, ...rest },
  ref,
) {
  const url = assetUrl(typeof src === "string" ? src : src.src);
  const st: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", color: "transparent", ...style }
    : { color: "transparent", ...style };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={url}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? "eager" : (loading ?? "lazy")}
      decoding="async"
      style={st}
      {...rest}
    />
  );
});

export default Image;
