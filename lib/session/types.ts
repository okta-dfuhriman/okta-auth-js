import { OktaAuthHttpInterface, OktaAuthHttpOptions } from '../http/types';
import { StorageManagerInterface } from '../storage/types';

type HttpMethods = 'POST' | 'DELETE' | 'GET' | 'PATCH';
interface SessionLink {
	name?: string;
	href: string;
	hints: {
		allow: HttpMethods[];
	};
}

// Session API
export interface SessionObject {
	status: string;
	refresh?: () => Promise<object>;
	user?: () => Promise<object>;
	[key: string]: any;
	_links: {
		self: SessionLink;
		refresh?: SessionLink;
		user?: Required<SessionLink>;
	};
}

export interface SessionAPI {
	close: () => Promise<object>;
	exists: () => Promise<boolean>;
	get: () => Promise<Omit<SessionObject, '_links'>>;
	refresh: () => Promise<object>;
	setCookieAndRedirect: (sessionToken?: string, redirectUri?: string) => void;
}

export interface OktaAuthSessionInterface
<
  S extends StorageManagerInterface = StorageManagerInterface,
  O extends OktaAuthHttpOptions = OktaAuthHttpOptions
>
  extends OktaAuthHttpInterface<S, O>
{
  session: SessionAPI;
  closeSession(): Promise<boolean>;
}
