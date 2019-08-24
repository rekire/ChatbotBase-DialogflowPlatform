import {
    Context,
    DefaultReply,
    Input,
    InputMethod,
    Output,
    VerifyDataHolder,
    VoicePermission,
    VoicePlatform
} from 'chatbotbase';
import * as uuidv4 from 'uuid/v4';

// TODO split the logic since this is just partially supporting Dialogflow (in fact just Actions on Google)
export class Dialogflow extends VoicePlatform {
    platformId(): string {
        return 'Dialogflow';
    }

    parse(body: any): Input {
        console.log('INPUT', body);
        if(body.result && body.result.source) return this.parseApiV1(body);
        if(body.responseId && body.queryResult) return this.parseApiV2(body);
        throw Error("Request version not detected");
    }

    private parseApiV1(body): Input {
        const data: Context = {};
        let inputMethod = InputMethod.text;
        body.result.contexts.forEach(context => {
            if(context.parameters && context.parameters.boxed) {
                data[context.name] = context.parameters.value
            } else {
                data[context.name] = context.parameters
            }
        });
        let platform, text, userId;
        if(body.originalRequest && body.originalRequest.source === 'google') {
            const capabilities = body.originalRequest.data.surface.capabilities;
            platform = 'Google Home';
            for(let i = 0; i < capabilities.length; i++) {
                if(capabilities[i].name === 'actions.capability.SCREEN_OUTPUT') {
                    platform = 'Google Assistant';
                    break;
                }
            }
            let storageUserId = null;
            if(body.originalRequest.data.user.userStorage) {
                storageUserId = JSON.parse(body.originalRequest.data.user.userStorage || "{}").data.userId;
            }
            userId = body.originalRequest.data.user.userId || storageUserId || uuidv4();
            const inputs = body.originalRequest.data.inputs;
            for(let i = 0; i < inputs.length; i++) {
                if(inputs[i].rawInputs) {
                    for(let j = 0; j < inputs[i].rawInputs.length; j++) {
                        if(inputs[i].rawInputs[j].query) {
                            text = inputs[i].rawInputs[j].query;
                            switch(inputs[i].rawInputs[j].inputType) {
                            case 'VOICE':
                                inputMethod = InputMethod.voice;
                                break;
                            case 'KEYBOARD':
                                inputMethod = InputMethod.text;
                                break;
                            case 'TOUCH':
                                inputMethod = InputMethod.touch;
                                break;
                            }
                            break;
                        }
                    }
                }
            }
        } else if(body.result && body.result.source === 'agent') {
            platform = 'Dialogflow';
            text = body.result.resolvedQuery;
            userId = 'unknown';
        }
        const input = new Input(
            body.id,
            userId,
            body.sessionId,
            body.lang || body.originalRequest.data.user.locale,
            platform,
            new Date(body.timestamp),
            body.result.metadata.intentName,
            inputMethod,
            text,
            data,
            body.originalRequest && body.originalRequest.data && body.originalRequest.data.user && body.originalRequest.data.user.accessToken || null);
        if(body.originalRequest && body.originalRequest.data.device && body.originalRequest.data.device.location) {
            input.internalData.set('df.userStorage', body.originalRequest.data.user.userStorage || JSON.stringify({data:{userId}}));
            input.internalData.set('df.location', body.originalRequest.data.device.location);
        }
        input.internalData.set('df.apiVersion', 1);
        return input;
    }

    private parseApiV2(body): Input {
        const data: Context = {};
        let inputMethod = InputMethod.text;
        body.queryResult.outputContexts.forEach(context => {
            const contextName = context.name.replace(`${body.session}/contexts/`, '');
            if(context.parameters && context.parameters.boxed) {
                data[contextName] = context.parameters.value
            } else {
                data[contextName] = context.parameters
            }
        });
        let platform, text, userId;
        if(body.originalDetectIntentRequest && body.originalDetectIntentRequest.source === 'google') {
            const capabilities = body.originalDetectIntentRequest.payload.surface.capabilities;
            platform = 'Google Home';
            for(let i = 0; i < capabilities.length; i++) {
                if(capabilities[i].name === 'actions.capability.SCREEN_OUTPUT') {
                    platform = 'Google Assistant';
                    break;
                }
            }
            let storageUserId = null;
            if(body.originalDetectIntentRequest.payload.user.userStorage) {
                storageUserId = JSON.parse(body.originalDetectIntentRequest.payload.user.userStorage).data.userId;
            }
            userId = body.originalDetectIntentRequest.payload.user.userId || storageUserId || uuidv4();
            body.originalDetectIntentRequest.payload.inputs.forEach(input => {
                if(input.rawInputs) {
                    input.rawInputs.forEach(rawInput => {
                        if(rawInput.query) {
                            text = rawInput.query;
                            switch(rawInput.inputType) {
                            case 'VOICE':
                                inputMethod = InputMethod.voice;
                                break;
                            case 'KEYBOARD':
                                inputMethod = InputMethod.text;
                                break;
                            case 'TOUCH':
                                inputMethod = InputMethod.touch;
                                break;
                            }
                        }
                    });
                }
            });
        } else {
            platform = 'Dialogflow';
            text = body.queryResult.queryText;
            userId = 'unknown';
        }

        const input = new Input(
            body.responseId,
            userId,
            body.session,
            body.queryResult.languageCode,
            platform,
            new Date(),
            body.queryResult.intent.displayName,
            inputMethod,
            text,
            data,
            body.originalDetectIntentRequest && body.originalDetectIntentRequest.payload.user && body.originalDetectIntentRequest.payload.user.accessToken || null);

        if(body.originalDetectIntentRequest && body.originalDetectIntentRequest.payload.device && body.originalDetectIntentRequest.payload.device.location) {
            input.internalData.set('df.location', body.originalDetectIntentRequest.payload.device.location);
        }
        input.internalData.set('df.apiVersion', 2);
        input.internalData.set('df.session', body.session);
        input.internalData.set('df.userStorage', ((body.originalDetectIntentRequest.payload.user && body.originalDetectIntentRequest.payload.user.userStorage) || JSON.stringify({data:{userId}})).data);

        return input;
    }

    // TODO Find out why this is required
    verify(request: VerifyDataHolder, response: any): Promise<boolean> | boolean {
        return true;
    }

    render(output: Output): any {
        let ssml = "", displayText = "", richMessages = <any>[], suggestions = <any>[], context = <any>[],
            messages = <any>[];
        let hasSimpleMessage = false;
        let systemIntent: any = null;
        const data = output.internalData;
        output.replies.forEach(reply => {
            if(reply.platform === '*') {
                if(reply.type === 'ssml') {
                    ssml = reply.render();
                } else if(reply.type === 'text') {
                    displayText = reply.render();
                }
            } else if(reply.platform === 'Dialogflow') {
                if(reply.type === 'simpleMessage') {
                    hasSimpleMessage = true;
                    richMessages.push(reply.render());
                } else if(reply.type === 'listCard') {
                    messages.push(reply.render());
                } else {
                    richMessages.push(reply.render());
                }
            } else if(reply.platform === 'ActionsOnGoogle') {
                if(reply.type === 'permission') {
                    if(systemIntent !== null) {
                        console.log('There can be just one system intent. The last is overwritten now!');
                    }
                    systemIntent = {
                        intent: 'assistant.intent.action.PERMISSION',
                        spec: reply.render()
                    };
                } else if(reply.type === 'system_intent') {
                    systemIntent = reply.render();
                }
            }
        });
        output.suggestions.forEach(suggestion => {
            if(suggestion.platform === 'Dialogflow') {
                suggestions.push(suggestion.render());
            } else if(suggestion.platform === '*') {
                suggestions.push({title: suggestion.render()});
            }
        });
        for(let key in output.context) {
            let value = output.context[key];
            if((typeof value) !== 'object') {
                value = {value: value, boxed: true};
            }
            if(data.get('df.apiVersion') === 1) {
                context.push({name: key, lifespan: 60, parameters: value});
            } else {
                context.push({name: key, lifespanCount: 60, parameters: value});
            }
        }
        // Generate proper default values
        displayText = displayText || '';
        ssml = ssml || displayText.replace(/<[^>]+>/g, '');
        displayText = displayText || ssml.replace(/<[^>]+>/g, '');
        //if(ssml.indexOf("<") > 0) {
        //    ssml = `<speak>${ssml}</speak>`;
        //}
        // add the display response if there is no explicit simple response
        if(!hasSimpleMessage) {
            // insert at front
            const newList = [{
                simpleResponse: {
                    ssml: `<speak>${ssml}</speak>`,
                    displayText
                }
            }];
            richMessages.forEach(msg => newList.push(msg));
            richMessages = newList
        }
        if(!output.expectAnswer) {
            suggestions = null;
        }
        const userStorageData = JSON.parse(data.get('df.userStorage') || "{}");
        userStorageData.userId = output.userId;
        let userStorage = JSON.stringify({data:userStorageData});
        switch(data.get('df.apiVersion')) {
        case 1: {
            // add the plain response for dialogflow
            messages.push([{type: 0, speech: displayText}]);
            const dialogflowV1Suggestions = {
                type: 2,
                replies: <any>[]
            };
            output.suggestions.forEach(suggestion => {
                if(suggestion.platform === '*') {
                    dialogflowV1Suggestions.replies.push(suggestion.render())
                }
            });
            messages.push(dialogflowV1Suggestions);
            const response = {
                speech: `<speak>${ssml}</speak>`,
                displayText,
                data: {
                    google: {
                        expectUserResponse: output.expectAnswer,
                        noInputPrompts: [],
                        richResponse: {
                            items: richMessages,
                            suggestions
                        },
                        systemIntent,
                        userStorage
                    }
                },
                messages,
                contextOut: context,
                source: 'ChatbotBase'
            };
            if(systemIntent == null) {
                delete response.data.google.systemIntent;
            }
            return response;
        }
        case 2: {
            // add the plain response for dialogflow
            messages.push({
                platform: "ACTIONS_ON_GOOGLE",
                text: {
                    text: [displayText]
                }
            });
            const dialogflowV2Suggestions = {
                platform: "ACTIONS_ON_GOOGLE",
                quickReplies: {
                    //title: "quick replies title",
                    quickReplies: <any>[]
                }
            };
            output.suggestions.forEach(suggestion => {
                if(suggestion.platform === '*') {
                    dialogflowV2Suggestions.quickReplies.quickReplies.push(suggestion.render())
                }
            });
            if(output.suggestions.length > 0) {
                messages.push(dialogflowV2Suggestions);
            }
            if(!output.expectAnswer) {
                context = [];
            }

            // add prefix to each context
            context.forEach(item => item.name = `${data.get('df.session')}/contexts/${item.name}`);
            const response = {
                fulfillmentText: displayText,
                payload: {
                    google: {
                        expectUserResponse: output.expectAnswer,
                        noInputPrompts: [],
                        richResponse: {
                            items: richMessages,
                            suggestions
                        },
                        systemIntent,
                        userStorage
                    }
                },
                fulfillmentMessages: messages,
                outputContexts: context,
                source: 'ChatbotBase'
            };
            if(output.suggestions.length == 0) {
                delete response.payload.google.richResponse.suggestions;
            }
            if(systemIntent == null) {
                delete response.payload.google.systemIntent;
            }
            return response;
        }
        default:
            throw Error("Cannot find out correct output format");
        }
    }

    isSupported(json: any) {
        return (json.result && json.result.source) || (json.responseId && json.queryResult)
    }

    static getPosition(input: Input): ActionsOnGoogleLocation | null {
        return input.internalData.get('df.location');
    }
}

type ReplyBuilder<T = {}> = new (...args: any[]) => T;

export function DialogflowReply<TBase extends ReplyBuilder>(Base: TBase) {
    return class extends Base {
        requestGooglePermission(reason: string, permissions: VoicePermission | string | (VoicePermission | string)[]) {
            let permissionList;
            if(permissions instanceof Array) {
                permissionList = permissions;
            } else {
                permissionList = [permissions];
            }
            if(permissionList.length > 0) return undefined;
            const voicePermissions: String[] = [];
            permissionList.forEach(permission => {
                switch(permission) {
                case VoicePermission.ExactPosition:
                    voicePermissions.push('DEVICE_PRECISE_LOCATION');
                    break;
                case VoicePermission.RegionalPosition:
                    voicePermissions.push('DEVICE_COARSE_LOCATION');
                    break;
                case VoicePermission.UserName:
                    voicePermissions.push('NAME');
                    break;
                    //case VoicePermission.Push:
                    //    voicePermissions.push('UPDATE');
                    //    break;
                case 'UPDATE':
                case 'UNSPECIFIED_PERMISSION':
                    voicePermissions.push(permission);
                    break;
                default:
                    return;
                }
            });
            (<DefaultReply><any>this).addReply({
                platform: 'ActionsOnGoogle',
                type: 'permission',
                render: () => {
                    return {
                        permission_value_spec: {
                            opt_context: reason,
                            permissions: voicePermissions
                        }
                    }
                },
                debug: () => 'Asking for permission: ' + voicePermissions.join(', ')
            });
        }

        /**
         * Request an explicit login, if the target platform has the option to explicit log in the user. The Alexa platform
         * supports that this feature since version 0.8 the Dialogflow platform (in fact just Actions on Google) since 0.4
         * and only if the login is not set as mandatory in the Actions on Google console.
         * @returns {boolean} true if it is possible to request the login.
         */
        requestGoogleLogin() {
            // ref: https://developers.google.com/actions/identity/account-linking#json
            (<DefaultReply><any>this).addReply({
                platform: 'ActionsOnGoogle',
                type: 'system_intent',
                render: () => {
                    return {
                        intent: 'actions.intent.SIGN_IN',
                        data: {}
                    }
                },
                debug: () => 'Login request'
            });
        }

        /**
         * Creates a simple response where the spoken text is equal to the shown text.
         * @param message the message the user should read and hear.
         * @param ssml the optional ssml of the response if not set it will take the message for ssml.
         */
        addGoogleSimpleResponse(message: string, ssml?: string) {
            (<DefaultReply><any>this).addReply({
                platform: 'Dialogflow',
                type: 'simpleMessage',
                render: () => {
                    return {
                        simpleResponse: {
                            ssml: `<speak>${ssml || message}</speak>`,
                            displayText: message
                        }
                    }
                },
                debug: () => message
            });
        }

        /**
         * Creates a basic card holds a title, a messages and optional a button.
         * @param title The title of the card.
         * @param message The message of the card.
         * @param button The button which should be shown (optional).
         */
        addGoogleBasicCard(title: string, message: string, button?: DialogflowButton) {
            (<DefaultReply><any>this).addReply({
                platform: 'Dialogflow',
                type: 'basicCard',
                render: () => {
                    return {
                        basicCard: {
                            title,
                            formattedText: message,
                            buttons: typeof button === 'object' ? [button.render()] : []
                        }
                    }
                },
                debug: () => `${title}: ${message}`
            });
        }

        /**
         * Creates a basic card with an image a title, a messages and optional a button.
         * @param imageUrl The url of the image to show.
         * @param accessibilityText The accessibility text for the image.
         * @param title The title of the card.
         * @param message The message of the card.
         * @param imageDisplayOptions The image display options, by default DEFAULT.
         * @param button The button which should be shown (optional).
         */
        addGoogleCardWithPicture(imageUrl: string, accessibilityText: string, title: string | undefined = undefined, message: string | undefined = undefined, imageDisplayOptions: ImageDisplays = ImageDisplays.DEFAULT, button?: DialogflowButton) {
            const basicCard = {
                image: {
                    url: imageUrl,
                    accessibilityText: accessibilityText
                },
                buttons: typeof button === 'object' ? [button.render()] : [],
                imageDisplayOptions: imageDisplayOptions
            };
            if(title) {
                basicCard["title"] = title;
            }
            if(message) {
                basicCard["formattedText"] = message;
            }
            (<DefaultReply><any>this).addReply({
                platform: 'Dialogflow',
                type: 'basicCard',
                render: () => {
                    return {basicCard}
                },
                debug: () => `Picture (${accessibilityText}) with title "${title}" and message "${message}"`
            });
        }

        addGoogleListResponse(cardTitle: string, list: ListItem[]) {
            const items: any[] = [];
            list.forEach(item => items.push(item.render()));
            (<DefaultReply><any>this).addReply({
                platform: 'Dialogflow',
                type: 'listCard',
                render: () => {
                    return {
                        type: 'list_card',
                        platform: 'google',
                        title: cardTitle,
                        items: items
                    }
                },
                debug: () => 'debug'
            });
        }
    }
}

export class DialogflowButton {
    private output: any;

    constructor(title: string, action: string) {
        this.output = {
            title: title,
            openUrlAction: {
                url: action
            }
        };
    }

    public render() {
        return this.output;
    }
}

export class ListItem {
    key: string;
    title: string;
    description: string;
    imageUrl: string;

    constructor(key: string, title: string, description: string, imageUrl: string) {
        this.key = key;
        this.title = title;
        this.description = description;
        this.imageUrl = imageUrl;
    }

    public render() {
        return {
            optionInfo: {
                key: this.key,
                synonyms: []
            },
            title: this.title,
            description: this.description,
            image: {
                url: this.imageUrl
            }
        };
    }
}

/**
 * List of possible options to display the image in a BasicCard.
 * When the aspect ratio of an image is not the same as the surface,
 * this attribute changes how the image is displayed in the card.
 * @enum {string}
 */
export enum ImageDisplays {
    /**
     * Pads the gaps between the image and image frame with a blurred copy of the
     * same image.
     */
    DEFAULT = 'DEFAULT',
    /**
     * Fill the gap between the image and image container with white bars.
     */
    WHITE = 'WHITE',
    /**
     * Image is centered and resized so the image fits perfectly in the container.
     */
    CROPPED = 'CROPPED'
}

/**
 * The location of a user as reported by Actions on Google.
 */
export class ActionsOnGoogleLocation {
    public zipCode: string | null;
    public formattedAddress: string | null;
    public city: string | null;
    public coordinates: ActionsOnGoogleCoordinates;
}

/**
 * The coordinates of the uer as reported by Actions on Google.
 */
export class ActionsOnGoogleCoordinates {
    public latitude: number;
    public longitude: number;
}