import { Input, Reply, VoicePlatform, Suggestion, Output, VoicePermission } from 'chatbotbase';
export declare class Dialogflow extends VoicePlatform {
    platformId(): string;
    parse(body: any): Input;
    render(output: Output): any;
    isSupported(json: any): any;
    requestPermission(reason: string, permissions: VoicePermission | string | (VoicePermission | string)[]): Reply | undefined;
    static displayTextReply(message: string): Reply;
    static basicCard(title: string, message: string, buttons?: DialogflowButton): Reply;
    static basicCardWithPicture(title: string, message: string, imageUrl: string, accessibilityText?: string, imageDisplayOptions?: ImageDisplays, buttons?: DialogflowButton): Reply;
    static imageCard(title: string, message: string, imageUrl: string, contentDescription?: string, buttons?: DialogflowButton): Reply;
    static suggestion(suggestion: string): Suggestion;
    static listResponse(cardTitle: string, list: ListItem[]): Reply;
    static getPosition(input: Input): ActionsOnGoogleLocation | null;
}
export declare class DialogflowButton {
    private output;
    constructor(title: string, action: string);
    render(): any;
}
export declare class ListItem {
    key: string;
    title: string;
    description: string;
    imageUrl: string;
    constructor(key: string, title: string, description: string, imageUrl: string);
    render(): {
        optionInfo: {
            key: string;
            synonyms: never[];
        };
        title: string;
        description: string;
        image: {
            url: string;
        };
    };
}
/**
 * List of possible options to display the image in a BasicCard.
 * When the aspect ratio of an image is not the same as the surface,
 * this attribute changes how the image is displayed in the card.
 * @enum {string}
 */
export declare enum ImageDisplays {
    /**
     * Pads the gaps between the image and image frame with a blurred copy of the
     * same image.
     */
    DEFAULT = "DEFAULT",
    /**
     * Fill the gap between the image and image container with white bars.
     */
    WHITE = "WHITE",
    /**
     * Image is centered and resized so the image fits perfectly in the container.
     */
    CROPPED = "CROPPED",
}
/**
 * The location of a user as reported by Actions on Google.
 */
export declare class ActionsOnGoogleLocation {
    zipCode: string | null;
    formattedAddress: string | null;
    city: string | null;
    coordinates: ActionsOnGoogleCoordinates;
}
/**
 * The coordinates of the uer as reported by Actions on Google.
 */
export declare class ActionsOnGoogleCoordinates {
    latitude: number;
    longitude: number;
}
