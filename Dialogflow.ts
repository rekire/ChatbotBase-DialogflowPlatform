import {Context, Input, InputMethod, Output, Reply, Suggestion, VoicePermission, VoicePlatform, VerifyDataHolder} from 'chatbotbase';

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
        const internalData = new Map<string, any>();
        internalData.set('apiVersion', 1);
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
            //text = body.originalRequest.data.inputs[0].rawInputs[0].query;
            userId = body.originalRequest.data.user.userId;
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
        if(body.originalRequest && body.originalRequest.data.device && body.originalRequest.data.device.location) {
            internalData.set('location', body.originalRequest.data.device.location);
        }
        return new DialogflowInput(
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
            body.originalRequest && body.originalRequest.data && body.originalRequest.data.user && body.originalRequest.data.user.accessToken || null,
            internalData);
    }

    private parseApiV2(body): Input {
        const data: Context = {};
        const internalData = new Map<string, any>();
        internalData.set('apiVersion', 2);
        internalData.set('session', body.session);
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
            userId = body.originalDetectIntentRequest.payload.user.userId || body.originalDetectIntentRequest.payload.user.idToken;
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
        if(body.originalDetectIntentRequest && body.originalDetectIntentRequest.payload.device && body.originalDetectIntentRequest.payload.device.location) {
            internalData.set('location', body.originalDetectIntentRequest.payload.device.location);
        }
        return new DialogflowInput(
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
            body.originalDetectIntentRequest && body.originalDetectIntentRequest.payload.user.accessToken || null,
            internalData);
    }

    // TODO Find out why this is required
    verify(request: VerifyDataHolder, response: any): Promise<boolean> | boolean {
        return true;
    }

    render(output: Output): any {
        let ssml, displayText, richMessages = <any>[], suggestions = <any>[], context = <any>[], messages = <any>[];
        let hasSimpleMessage = false;
        let systemIntent: any = null;
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
                suggestions.push(Dialogflow.suggestion(suggestion.render()).render());
            }
        });
        for(let key in output.context) {
            let value = output.context[key];
            if((typeof value) !== 'object') {
                value = {value: value, boxed: true};
            }
            if(output.data.get('apiVersion') === 1) {
                context.push({name: key, lifespan: 60, parameters: value});
            } else {
                context.push({name: key, lifespanCount: 60, parameters: value});
            }
        }
        // Generate proper default values
        displayText = displayText || '';
        ssml = ssml || displayText.replace(/<[^>]+>/g, '');
        displayText = displayText || ssml.replace(/<[^>]+>/g, '');
        if(ssml.indexOf("<") >= 0) {
            ssml = `<speak>${ssml}</speak>`;
        }
        // add the display response if there is no explicit simple response
        if(!hasSimpleMessage) {
            // insert at front
            const newList = [{
                simpleResponse: {
                    textToSpeech: ssml,
                    displayText
                }
            }];
            richMessages.forEach(msg => newList.push(msg));
            richMessages = newList
        }
        if(!output.expectAnswer) {
            suggestions = null;
        }
        switch(output.data.get('apiVersion')) {
        case 1:
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
            return {
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
                        systemIntent
                    }
                },
                messages,
                contextOut: context,
                source: 'ChatbotBase'
            };
        case 2:
            // add the plain response for dialogflow
            messages.push([{
                platform: "ACTIONS_ON_GOOGLE",
                text: {
                    text: displayText
                }
            }]);
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
            messages.push(dialogflowV2Suggestions);

            // add prefix to each context
            context.forEach(item => item.name = `${output.data.get('session')}/contexts/${item.name}`);
            return {
                fulfillmentText: displayText,
                payload: {
                    google: {
                        expectUserResponse: output.expectAnswer,
                        noInputPrompts: [],
                        richResponse: {
                            items: richMessages,
                            suggestions
                        },
                        systemIntent
                    }
                },
                fulfillmentMessages: messages,
                outputContexts: context,
                source: 'ChatbotBase'
            };
        default:
            throw Error("Cannot find out correct output format");
        }
    }

    isSupported(json: any) {
        return (json.result && json.result.source) || (json.responseId && json.queryResult)
    }

    requestPermission(reason: string, permissions: VoicePermission | string | (VoicePermission | string)[]): Reply | undefined {
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
                return undefined;
            }
        });
        return {
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
        };
    }

    /**
     * Request an explicit login, if the target platform has the option to explicit log in the user. The Alexa platform
     * supports that this feature since version 0.8 the Dialogflow platform (in fact just Actions on Google) since 0.4
     * and only if the login is not set as mandatory in the Actions on Google console.
     * @returns {boolean} true if it is possible to request the login.
     */
    requestLogin(): boolean | Reply {
        // ref: https://developers.google.com/actions/identity/account-linking#json
        return {
            platform: 'ActionsOnGoogle',
            type: 'system_intent',
            render: () => {
                return {
                    intent: 'actions.intent.SIGN_IN',
                    data: {}
                }
            },
            debug: () => 'Login request'
        };
    }

    /**
     * Creates a simple response where the spoken text is equal to the shown text.
     * @param message the message the user should read and hear.
     */
    static simpleReply(message: string): Reply {
        return {
            platform: 'Dialogflow',
            type: 'simpleMessage',
            render: () => {
                return {
                    simpleResponse: {
                        textToSpeech: message,
                        displayText: message
                    }
                }
            },
            debug: () => message
        };
    }

    /**
     * Creates a basic card holds a title, a messages and optional a button.
     * @param title The title of the card.
     * @param message The message of the card.
     * @param button The button which should be shown (optional).
     */
    static basicCard(title: string, message: string, button?: DialogflowButton): Reply {
        return {
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
        };
    }

    /**
     * Creates a basic card with an image a title, a messages and optional a button.
     * @param title The title of the card.
     * @param message The message of the card.
     * @param imageUrl The url of the image to show.
     * @param accessibilityText The accessibility text for the image.
     * @param imageDisplayOptions The image display options, by default DEFAULT.
     * @param button The button which should be shown (optional).
     */
    // FIXME if there is an image the title and text is optional
    static basicCardWithPicture(title: string, message: string, imageUrl: string, accessibilityText: string, imageDisplayOptions: ImageDisplays = ImageDisplays.DEFAULT, button?: DialogflowButton): Reply {
        return {
            platform: 'Dialogflow',
            type: 'basicCard',
            render: () => {
                return {
                    basicCard: {
                        title,
                        formattedText: message,
                        image: {
                            url: imageUrl,
                            accessibilityText: accessibilityText
                        },
                        buttons: typeof button === 'object' ? [button.render()] : [],
                        imageDisplayOptions: imageDisplayOptions
                    }
                }
            },
            debug: () => message
        };
    }

    static suggestion(suggestion: string): Suggestion {
        return <Suggestion>{
            platform: 'Dialogflow',
            render: () => {
                return {
                    title: suggestion
                }
            },
            toString: () => suggestion
        };
    }

    static listResponse(cardTitle: string, list: ListItem[]): Reply {
        const items: any[] = [];
        list.forEach(item => items.push(item.render()));
        return {
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
        }
    }

    static getPosition(input: Input): ActionsOnGoogleLocation | null {
        if(input instanceof DialogflowInput) {
            return input.data.get('location');
        }
        return null;
    }

    /**
     * Defines a
     * @param ssml
     * @param displayText
     */
    static splittedSimpleReply(ssml: string, displayText: string): Reply {
        return {
            platform: 'Dialogflow',
            type: 'simpleMessage',
            render: () => {
                return {
                    simpleResponse: {
                        textToSpeech: `<speak>${ssml}</speak>`,
                        displayText
                    }
                };
            },
            debug: () => displayText
        };
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

/**
 * Private extended model to store metadata of an input.
 */
class DialogflowInput extends Input {
    /**
     * Private internal data
     */
    data: Map<string, any>;

    constructor(id: string,
                userId: string,
                sessionId: string,
                language: string,
                platform: string,
                time: Date,
                intent: string,
                inputMethod: InputMethod,
                message: string,
                context: Context,
                accessToken: string,
                data: Map<string, any>) {
        super(id, userId, sessionId, language, platform, time, intent, inputMethod, message, context, accessToken);
        this.data = data;
    }

    reply(): Output {
        const self = <Output>this;
        return new DialogflowOutput(self.id + '.reply', self.userId, self.sessionId, self.platform, self.language, self.intent, "", self.context, this.data)
    }
}

/**
 * Private extended model to store metadata of an input.
 */
class DialogflowOutput extends Output {
    /**
     * Private internal data
     */
    data: Map<string, any>;

    constructor(id: string,
                userId: string,
                sessionId: string,
                platform: string,
                language: string,
                intent: string,
                message: string,
                context: Context,
                data: Map<string, any>) {
        super(id, userId, sessionId, platform, language, intent, message, context);
        this.data = data;
    }
}