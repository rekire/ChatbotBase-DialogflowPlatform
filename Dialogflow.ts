import {Input, Reply, InputMethod, VoicePlatform, Suggestion, Context, Output} from 'chatbotbase';

// TODO split the logic since this is just partially supporting Dialogflow (in fact just Actions on Google)
export class Dialogflow extends VoicePlatform {
    platformId(): string {
        return 'Dialogflow';
    }

    parse(body: any): Input {
        console.log('INPUT', body);
        const data: Context = {};
        let inputMethod = InputMethod.text;
        body.result.contexts.forEach(context => {
            if(context.parameters && context.parameters.boxed === true) {
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
        return new Input(
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
            body.originalRequest.data.user.accessToken);
    }

    render(output: Output): any {
        let plainReply, formattedReply, messages = <any>[], suggestions = <any>[], context = <any>[], test = <any>[];
        let hasSimpleMessage = false;
        output.replies.forEach(reply => {
            if(reply.platform === '*') {
                if(reply.type === 'plain') {
                    plainReply = reply.render();

                } else if(reply.type === 'formatted') {
                    formattedReply = reply.render();
                }
            } else if(reply.platform === 'Dialogflow') {
                if(reply.type === 'simpleMessage') {
                    hasSimpleMessage = true;
                }
                if(reply.type === 'listCard') {
                    test.push(reply.render());
                } else {
                    messages.push(reply.render());
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
            context.push({name: key, lifespan: 60, parameters: value});
        }
        formattedReply = formattedReply || plainReply;
        // add the plain response if there is no explicit simple response
        if(!hasSimpleMessage) {
            // insert at front
            const newList = [{
                simpleResponse: {
                    textToSpeech: plainReply,
                    displayText: formattedReply
                }
            }];
            messages.forEach(msg => newList.push(msg));
            messages = newList
        }
        // add the plain response for dialogflow
        test.push([{type: 0, speech: plainReply}]);
        const dialogflowSuggestions = {
            type: 2,
            replies: <any>[]
        };
        output.suggestions.forEach(suggestion => {
            if(suggestion.platform === '*') {
                dialogflowSuggestions.replies.push(suggestion.render())
            }
        });
        test.push(dialogflowSuggestions);
        return {
            speech: `<speak>${plainReply}</speak>`,
            displayText: formattedReply || plainReply,
            data: {
                google: {
                    expectUserResponse: output.expectAnswer,
                    noInputPrompts: [],
                    richResponse: {
                        items: messages,
                        suggestions: suggestions
                    }
                }
            },
            messages: test,
            contextOut: context,
            source: 'Whatever'
        };
    }

    isSupported(json: any) {
        return json.hasOwnProperty('originalRequest') || (json.result && json.result.source)
    }

    static simpleReply(message: string): Reply {
        return <Reply>{
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

    static basicCard(title: string, message: string, buttons?: DialogflowButton): Reply {
        return <Reply>{
            platform: 'Dialogflow',
            type: 'basicCard',
            render: () => {
                return {
                    basicCard: {
                        title: title,
                        formattedText: message,
                        buttons: typeof buttons === 'object' ? [buttons.render()] : []
                    }
                }
            },
            debug: () => message
        };
    }

    static basicCardWithPicture(title: string, message: string, imageUrl: string, accessibilityText: string = '', imageDisplayOptions: ImageDisplays = ImageDisplays.DEFAULT, buttons?: DialogflowButton): Reply {
        return <Reply>{
            platform: 'Dialogflow',
            type: 'basicCard',
            render: () => {
                return {
                    basicCard: {
                        title: title,
                        formattedText: message,
                        image: {
                            url: imageUrl,
                            accessibilityText: accessibilityText
                        },
                        buttons: typeof buttons === 'object' ? [buttons.render()] : [],
                        imageDisplayOptions: imageDisplayOptions
                    }
                }
            },
            debug: () => message
        };
    }

    static imageCard(title: string, message: string, imageUrl: string, contentDescription?: string, buttons?: DialogflowButton): Reply {
        return <Reply>{
            platform: 'Dialogflow',
            type: 'basicCard',
            render: () => {
                return {
                    basicCard: {
                        title: title,
                        formattedText: message,
                        image: {
                            url: imageUrl,
                            accessibility_text: contentDescription
                        },
                        buttons: typeof buttons === 'object' ? [buttons.render()] : [],
                        imageDisplayOptions: 'CROPPED'
                        // https://github.com/actions-on-google/actions-on-google-nodejs/commit/72dfe485797804e0be921d31822a7fa71234bce7
                    }
                }
            },
            debug: () => `Dialog with title "${title}" and message "${message}".`
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
        const items = <any>[];
        list.forEach(item => items.push(item.render()));
        return <Reply>{
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