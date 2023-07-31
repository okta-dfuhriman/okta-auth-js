/* eslint-disable max-len */
import { AuthSdkError } from '../../errors';
import { convertTokenParamsToOAuthParams } from './authorize';
import { httpRequest } from '../../http';

import { TokenParams } from '../types';

export interface PushedAuthorizationResponse {
	request_uri: string;
	expires_in: number;
}

export interface PostToParEndpointResponse {
	requestUri: string;
	expiresAt: number;
}

export async function postToParEndpoint(sdk, { jwtAuthorizationRequest, ...options }: TokenParams) {
	const data = convertTokenParamsToOAuthParams(options);

	const headers = {
		'Content-Type': 'application/x-www-form-urlencoded',
	};

	if (!options?.pushAuthorizationUrl) {
		throw new AuthSdkError(
			'In order to use push authorization request, a valid URL must be specified in the OktaAuth constructor that will generate the push authorization and return the appropriate response.'
		);
	}

	const now = Math.floor(Date.now() / 1000);

	const { request_uri: requestUri, expires_in: expiresIn } = await httpRequest<PushedAuthorizationResponse>(sdk, {
		url: options?.pushAuthorizationUrl,
		method: 'POST',
		args: {
			jwtAuthorizationRequest,
			data,
		},
		headers,
	});

	return { requestUri, expiresAt: expiresIn + now };
}
