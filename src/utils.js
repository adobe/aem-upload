import axios from 'axios';

export async function timedRequest(requestOptions) {
    const reqStart = new Date().getTime();
    const response = await axios(requestOptions);
    response.elapsedTime = new Date().getTime() - reqStart;
    return response;
}
